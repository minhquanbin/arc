import { NextResponse } from "next/server";

const CIRCLE_API_BASE_URL = "https://api.circle.com/v1/w3s";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CIRCLE_API_KEY env var" },
        { status: 500 }
      );
    }

    if (!entitySecret) {
      return NextResponse.json(
        { error: "Missing CIRCLE_ENTITY_SECRET env var" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { templateId, requestBody } = body || {};

    if (!templateId || !requestBody) {
      return NextResponse.json(
        { error: "templateId and requestBody are required" },
        { status: 400 }
      );
    }

    // ✅ Replace placeholder with actual entity secret
    const finalRequestBody = {
      ...requestBody,
      entitySecretCiphertext: entitySecret, // Inject from server env
    };

    // Log for debugging (remove in production)
    console.log("Deploying with params:", {
      templateId,
      blockchain: finalRequestBody.blockchain,
      walletId: finalRequestBody.walletId,
      hasIdempotencyKey: !!finalRequestBody.idempotencyKey,
      hasEntitySecret: !!finalRequestBody.entitySecretCiphertext,
    });

    const upstream = await fetch(
      `${CIRCLE_API_BASE_URL}/templates/${templateId}/deploy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalRequestBody),
      }
    );

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!upstream.ok) {
      console.error("Circle API error:", {
        status: upstream.status,
        statusText: upstream.statusText,
        response: json,
      });

      return NextResponse.json(
        {
          error: "Circle API deployment failed",
          status: upstream.status,
          statusText: upstream.statusText,
          details: json,
        },
        { status: upstream.status }
      );
    }

    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    console.error("Deploy route error:", e);
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}