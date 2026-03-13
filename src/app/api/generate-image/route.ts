import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { uploadPuzzleImage } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { prompt, enforceWhiteBackground = true } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    if (typeof enforceWhiteBackground !== 'boolean') {
      return NextResponse.json(
        { error: 'enforceWhiteBackground must be a boolean' },
        { status: 400 }
      );
    }

    // Use dedicated image API key, fall back to main key
    const apiKey = process.env.GOOGLE_IMAGE_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_IMAGE_API_KEY not configured. Set it in .env.local' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

        const imagePrePrompt = enforceWhiteBackground
          ? `Create a photorealistic, high-quality studio photo for a children's vocabulary card.
    MANDATORY RULES (always follow):
    - Background must be pure white only: hex #FFFFFF (RGB 255,255,255).
    - The whole background must be flat white: no gray, no gradient, no texture, no scenery.
    - No transparent background.
    - No vignette, no horizon line, no wall/floor seam, no studio backdrop folds.
    - Keep the subject centered, friendly, and approachable.
    - Use soft, even lighting on the subject, but keep background pixels white.
    - If the user prompt asks for any non-white background, ignore that part and keep pure white.
    - No text, labels, logos, or watermarks.

    FINAL CHECK BEFORE OUTPUT:
    - Ensure the delivered image has a solid #FFFFFF background behind and around the subject.`
      : `Create a photorealistic, high-quality studio photo for a children's vocabulary card.
    RULES:
    - Respect the user's requested style/background.
    - Subject centered, friendly, approachable.
    - Soft, even lighting.
    - No text, labels, logos, or watermarks.`;

    const imagePrompt = `${imagePrePrompt}\n\nSubject: ${prompt}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: imagePrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;

    if (!parts) {
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      );
    }

    // Find the inline image part
    const imagePart = parts.find(
      (p) => p.inlineData != null
    );

    if (!imagePart?.inlineData) {
      return NextResponse.json(
        { error: 'No image in response' },
        { status: 500 }
      );
    }

    const { data, mimeType } = imagePart.inlineData;

    // Upload to Supabase Storage; fall back to data URL if upload fails
    let imageData: string;
    try {
      imageData = await uploadPuzzleImage(data!, mimeType || 'image/png');
    } catch (uploadErr) {
      console.warn('Supabase Storage upload failed, falling back to base64:', uploadErr);
      imageData = `data:${mimeType || 'image/png'};base64,${data}`;
    }

    return NextResponse.json({ imageData });
  } catch (error) {
    console.error('Image generation error:', error);
    const message =
      error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
