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

export async function scanWithGPTZero(text: string): Promise<GPTZeroScanResult> {
    if (!text || !text.trim()) {
        return { error: "No text provided" };
    }

    try {
        const scanId = crypto.randomUUID();

        const response = await fetch("https://api.gptzero.me/v3/ai/text", {
            method: "POST",
            headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                scanId,
                multilingual: true,
                document: text,
                interpretability_required: false,
            }),
        });

        if (!response.ok) {
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