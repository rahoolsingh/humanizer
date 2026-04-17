import { NextResponse } from "next/server";
import { scanWithGPTZero } from "../../actions";

type ScanRequestBody = {
    text?: string;
    gptZeroAccessToken?: string;
    gptZeroCsrfToken?: string;
    gptZeroRawCookie?: string;
};

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ScanRequestBody;
        const result = await scanWithGPTZero(body.text ?? "", {
            accessToken:
                body.gptZeroAccessToken ?? process.env.GPTZERO_ACCESS_TOKEN,
            csrfToken: body.gptZeroCsrfToken ?? process.env.GPTZERO_CSRF_TOKEN,
            rawCookie: body.gptZeroRawCookie ?? process.env.GPTZERO_COOKIE,
        });

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