import { useEffect, useMemo, useRef, useState } from "react";
import { acquireRegexMatcher } from "./regex-runner.js";

export function useRegexMatches(entries, text) {
  const lease = useRef(null);
  const texts = useMemo(() => text.split("\n"), [text]);
  const [result, setResult] = useState({ lines: [], error: "" });
  useEffect(() => {
    const current = acquireRegexMatcher(); lease.current = current;
    return () => { current.release(); lease.current = null; };
  }, []);
  useEffect(() => {
    let current = true;
    setResult({ lines: [], error: "" });
    const timer = setTimeout(() => {
      lease.current?.match(entries, texts).then((value) => {
        if (current && !value.cancelled) setResult({ lines: value.lines ?? [], error: value.error ?? "" });
      });
    }, 80);
    return () => { current = false; clearTimeout(timer); };
  }, [entries, texts]);
  return result;
}
