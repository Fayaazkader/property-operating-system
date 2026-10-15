import { NextResponse } from 'next/server';

/** Legacy intake lacks immutable commercial approval and executed provenance.
 * Resume through the governed workspace; never guess contractual tax or price.
 */
export async function POST() {
  return NextResponse.json({error:'This intake activation path has been retired. Review and activate the lease through the governed commercial leasing workflow.',code:'GOVERNED_ACTIVATION_REQUIRED',workspace:'/commercial-leasing'}, {status:410});
}
