
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
    return NextResponse.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://browser.ponsrischool.in/oauth2callback',
        firebaseConfig: process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : null,
    }, {
        headers: {
            'Access-Control-Allow-Origin': '*', // Allow fetch from Electron app
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
