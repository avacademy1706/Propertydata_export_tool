# Note for the backend developer — Login / Auth API

**From:** Property Desk frontend
**What this covers:** the login screen we just added and the exact auth API the Python backend
must expose so the dashboard keeps working. Full detail lives in
[`BACKEND_API_SPEC.md` §6.0](./BACKEND_API_SPEC.md#60-authentication) and §5 (conventions); this is
the short version you can build from.

---

## 1. What the frontend already does

- There is a `/login` page (email + password). On submit it does
  `POST /api/auth/login {email, password}`.
- On every load the dashboard calls `GET /api/auth/me` to decide whether to show the **Sign out**
  button and whether the session is still valid.
- **Sign out** does `POST /api/auth/logout`, then sends the user back to `/login`.
- All of this is **cookie-based** — the browser sends the cookie automatically. The frontend never
  sees or stores the token; do **not** switch us to an `Authorization: Bearer` header without telling
  us, or login breaks.

So you need exactly three endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
(under the `/api` prefix, same as every other endpoint).

---

## 2. The model (v1 — single admin, keep it simple)

- **No user table, no signup, no reset.** One admin email + one shared password from env:
  - `APP_ADMIN_EMAIL` (default `admin@propertydesk.local`, compared case-insensitively)
  - `APP_ACCESS_PASSWORD` (the password)
  - `AUTH_SECRET` (signs the session cookie — **required** when the password is set; fail startup if missing)
- **Auth is ON only when `APP_ACCESS_PASSWORD` is set.** If it's empty, auth is disabled (trusted
  local dev): the gate is a no-op, `/auth/me` returns an anonymous user, and `/auth/login` returns
  `503 not_configured`.
- When we move to real multi-user accounts later, these three endpoints stay the same shape — you'll
  just swap the credential check and token subject. Build them so that's a small change.

---

## 3. The session cookie (must match exactly)

Stateless signed token — no server-side session store needed.

```
payload   = base64url(json({"email": <lowercased email>, "exp": <unix seconds, now + 7 days>}))
signature = base64url(HMAC_SHA256(AUTH_SECRET, payload))
token     = payload + "." + signature
```

Delivered as a cookie named **`pd_session`**:

```
Set-Cookie: pd_session=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800
```

- Add `Secure` when `ENV=production` (HTTPS). Keep it off in local HTTP dev or the cookie won't stick.
- **Never** put the password or `AUTH_SECRET` in the payload — only the email + expiry.
- To verify: split on the last `.`, recompute the HMAC over `payload`, compare **in constant time**,
  then decode the payload and reject if `exp` is in the past.

---

## 4. The three endpoints

### `POST /auth/login`
Body `{"email": "...", "password": "..."}` (both required, 1–200 chars).

1. If auth disabled → `503 {"success": false, "error": {"code": "not_configured", ...}}`.
2. Check `email == APP_ADMIN_EMAIL` (case-insensitive) **and** `password == APP_ACCESS_PASSWORD`,
   both with a **constant-time compare** (`hmac.compare_digest`). On failure →
   `401 {"success": false, "error": {"code": "unauthorized", "message": "Incorrect email or password."}}`
   — same message for wrong email and wrong password (don't reveal which).
3. On success → set the `pd_session` cookie and return
   `200 {"success": true, "email": "<lowercased email>"}`.

### `POST /auth/logout`
Always `200 {"success": true, "loggedOut": true}` and set `pd_session` with `Max-Age=0` to clear it.
Idempotent — fine to call with no cookie.

### `GET /auth/me`
- Auth disabled → `200 {"success": true, "authEnabled": false, "user": {"email": "local"}}`
- Valid cookie → `200 {"success": true, "authEnabled": true, "user": {"email": "<email>"}}`
- No / bad / expired cookie → `401 {"success": false, "authEnabled": true, "user": null}`

> Note the `authEnabled` flag — the frontend relies on it. `/auth/me` must return **200 even when auth
> is disabled** (that's not an error, it's "running open on local dev").

---

## 5. The route gate (middleware)

Enforce the cookie on **every** request **except** these public paths:

```
/_next/*        (static assets)
/login          (the login page)
/api/auth/*     (login/logout/me themselves)
/api/whatsapp/webhook   (authenticated by Meta signature, not the cookie — see §6.10)
/favicon.ico
```

- When auth is **disabled**, the gate does nothing.
- When enabled and the session is missing/invalid:
  - a **page** request → `307` redirect to `/login?next=<original path>`
  - an **`/api/*`** request → `401 {"success": false, "error": {"code": "unauthorized", "message": "Login required."}}`

---

## 6. FastAPI reference (drop-in shape)

```python
import hmac, time, json, base64
from hashlib import sha256
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel, constr

router = APIRouter(prefix="/api/auth")
COOKIE = "pd_session"
TTL = 60 * 60 * 24 * 7  # 7 days

def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def make_token(email: str) -> str:
    payload = _b64(json.dumps({"email": email.lower(), "exp": int(time.time()) + TTL}).encode())
    sig = _b64(hmac.new(settings.AUTH_SECRET.encode(), payload.encode(), sha256).digest())
    return f"{payload}.{sig}"

def read_token(token: str | None) -> dict | None:
    if not token or "." not in token:
        return None
    payload, _, sig = token.rpartition(".")
    expected = _b64(hmac.new(settings.AUTH_SECRET.encode(), payload.encode(), sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        data = json.loads(_unb64(payload))
    except Exception:
        return None
    if not data.get("email") or int(data.get("exp", 0)) < int(time.time()):
        return None
    return data

def set_cookie(resp: Response, token: str, *, remove: bool = False) -> None:
    resp.set_cookie(
        COOKIE, "" if remove else token,
        max_age=0 if remove else TTL,
        httponly=True, samesite="lax", path="/",
        secure=settings.ENV == "production",
    )

class LoginBody(BaseModel):
    email: constr(min_length=1, max_length=200)
    password: constr(min_length=1, max_length=200)

@router.post("/login")
def login(body: LoginBody, resp: Response):
    if not settings.APP_ACCESS_PASSWORD:
        raise HTTPException(503, detail={"code": "not_configured", "message": "Authentication is not enabled."})
    email_ok = body.email.strip().lower() == settings.APP_ADMIN_EMAIL.lower()
    pw_ok = hmac.compare_digest(body.password, settings.APP_ACCESS_PASSWORD)
    if not (email_ok and pw_ok):
        raise HTTPException(401, detail={"code": "unauthorized", "message": "Incorrect email or password."})
    set_cookie(resp, make_token(body.email))
    return {"success": True, "email": body.email.strip().lower()}

@router.post("/logout")
def logout(resp: Response):
    set_cookie(resp, "", remove=True)
    return {"success": True, "loggedOut": True}

@router.get("/me")
def me(request: Request, resp: Response):
    if not settings.APP_ACCESS_PASSWORD:
        return {"success": True, "authEnabled": False, "user": {"email": "local"}}
    data = read_token(request.cookies.get(COOKIE))
    if not data:
        resp.status_code = 401
        return {"success": False, "authEnabled": True, "user": None}
    return {"success": True, "authEnabled": True, "user": {"email": data["email"]}}
```

(Wire the error envelope through your existing exception handler so `HTTPException.detail` becomes
`{"success": false, "error": {code, message}}` — same as every other endpoint.)

---

## 7. Security checklist

- [ ] Constant-time compare for both the password **and** the cookie signature (`hmac.compare_digest`).
- [ ] `AUTH_SECRET`, `APP_ACCESS_PASSWORD` come from Secrets Manager — never in code, logs, or the frontend.
- [ ] Never log the submitted password or the token.
- [ ] Cookie is `HttpOnly` + `SameSite=Lax`, and `Secure` in production.
- [ ] Same error message for wrong email vs wrong password.
- [ ] The gate exempts `/api/whatsapp/webhook` (it uses the Meta signature instead).
- [ ] Rate-limit `/auth/login` (reuse `RATE_LIMIT_PER_MIN`) to blunt brute force.
