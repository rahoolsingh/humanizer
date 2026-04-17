export type GPTZeroScanResult =
    | {
          success: true;
          aiPercent: number;
          humanPercent: number;
          isAi: boolean;
      }
    | {
          error: string;
      };

type GPTZeroResponse = {
    documents?: Array<{
        class_probabilities?: {
            ai?: number;
        };
    }>;
};

type GPTZeroAuthConfig = {
    accessToken?: string;
    csrfToken?: string;
    rawCookie?: string;
};

function buildGptZeroCookie(auth?: GPTZeroAuthConfig): string | undefined {
    if (auth?.rawCookie?.trim()) {
        return auth.rawCookie.trim();
    }

    const cookieParts: string[] = [];
    if (auth?.accessToken?.trim()) {
        cookieParts.push(`accessToken4=${auth.accessToken.trim()}`);
    }
    if (auth?.csrfToken?.trim()) {
        cookieParts.push(`__Host-gptzero-csrf-token=${auth.csrfToken.trim()}`);
    }

    if (cookieParts.length === 0) {
        return undefined;
    }

    return cookieParts.join("; ");
}

export async function scanWithGPTZero(
    text: string,
    auth?: GPTZeroAuthConfig,
): Promise<GPTZeroScanResult> {
    if (!text || !text.trim()) {
        return { error: "No text provided" };
    }

    try {
        const scanId = crypto.randomUUID();

        const cookie = buildGptZeroCookie(auth);

        const response = await fetch("https://api.gptzero.me/v3/ai/text", {
            method: "POST",
            headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
                Origin: "https://app.gptzero.me",
                Referer: "https://app.gptzero.me/",
                "x-gptzero-platform": "webapp",
                ...(cookie ? { Cookie: cookie } : {}),
            },
            body: JSON.stringify({
                scanId,
                multilingual: true,
                document: text,
                interpretability_required: false,
            }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error(
                    "GPTZero returned 401. Add a valid accessToken4 and __Host-gptzero-csrf-token in the UI before scanning.",
                );
            }
            throw new Error(`Server returned ${response.status}`);
        }

        const data = (await response.json()) as GPTZeroResponse;
        const aiProb = data?.documents?.[0]?.class_probabilities?.ai ?? 0;
        const aiPercent = Math.round(aiProb * 100);
        const humanPercent = 100 - aiPercent;

        return {
            success: true,
            aiPercent,
            humanPercent,
            isAi: aiPercent > 50,
        };
    } catch (error: unknown) {
        console.error("GPTZero Scan Error:", error);
        return {
            error: error instanceof Error ? error.message : "Failed to scan text",
        };
    }
}