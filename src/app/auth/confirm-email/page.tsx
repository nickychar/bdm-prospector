import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail } from 'lucide-react'

export default function ConfirmEmailPage() {
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
          <Mail className="h-6 w-6 text-zinc-600" />
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent you a confirmation link. Click it to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive it? Check your spam folder or try signing up again.
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Link
          href="/auth/login"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
