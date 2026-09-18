import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

import { auth } from '@/lib/firebase';
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
