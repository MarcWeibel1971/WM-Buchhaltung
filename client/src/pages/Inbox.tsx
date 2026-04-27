import { useEffect } from "react";
import { useLocation } from "wouter";

// Inbox wurde mit dem Dashboard zusammengeführt — diese Seite leitet weiter.
export default function Inbox() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  return null;
}
