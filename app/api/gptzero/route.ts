import { NextResponse } from "next/server";
import { scanWithGPTZero } from "../../actions";

type ScanRequestBody = {
    text?: string;
};

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ScanRequestBody;
        const result = await scanWithGPTZero(body.text ?? "");

        if ("error" in result) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to scan text",
            },
            { status: 500 },
        );
    }
}