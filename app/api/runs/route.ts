import { NextResponse } from 'next/server'
import { getRecentRuns, initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    const runs = await getRecentRuns(20)
    return NextResponse.json({ runs })
  } catch (error) {
    console.error('Runs fetch error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
