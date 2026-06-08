"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, verifyToken } from "./auth";

export function useAuthGuard() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    verifyToken().then((valid) => {
      if (!valid) router.replace("/login");
    });
  }, [router]);
}
