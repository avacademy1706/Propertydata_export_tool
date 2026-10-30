import type { Classification, ExtractionResult, ImageDescription } from "@/server/ai/schemas.ts";

export interface ClassifyInput {
  text: string;
}

export interface ExtractInput {
  text: string;
  hint: "auto" | "buyer" | "seller";
}

export interface DescribeImageInput {
  base64: string;
  mimeType: string;
}

export interface AiProvider {
  readonly name: string;
  classify(input: ClassifyInput): Promise<Classification>;
  extract(input: ExtractInput): Promise<ExtractionResult>;
  describeImage?(input: DescribeImageInput): Promise<ImageDescription>;
}
