import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'A DOCX file is required.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await mammoth.convertToHtml({
      buffer,
    });

    return NextResponse.json({
      html: result.value,
      messages: result.messages,
    });
  } catch (error) {
    console.error('Lease template preview error:', error);

    return NextResponse.json(
      { error: 'Unable to render the Word document preview.' },
      { status: 500 }
    );
  }
}