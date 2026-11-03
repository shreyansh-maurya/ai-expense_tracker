import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Expenses, budgets, recurring bills and your wishlist stay private to this account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="register" />
      </CardContent>
    </Card>
  );
}
