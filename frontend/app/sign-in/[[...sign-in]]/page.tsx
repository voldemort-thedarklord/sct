import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] p-6">
      <Suspense fallback={<div className="text-sm text-zinc-400">Loading sign in...</div>}>
        <SignIn />
      </Suspense>
    </div>
  );
}
