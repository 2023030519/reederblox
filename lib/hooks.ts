"use client";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Me = { user: User | null; isCreator: boolean; username: string; ready: boolean };

export function useMe(): Me {
  const [me, setMe] = useState<Me>({ user: null, isCreator: false, username: "", ready: false });
  useEffect(() => {
    const load = async (user: User | null) => {
      let isCreator = false, username = "";
      if (user) {
        const { data } = await supabase.from("profiles").select("is_creator,username").eq("id", user.id).maybeSingle();
        isCreator = !!data?.is_creator;
        username = data?.username ?? "";
      }
      setMe({ user, isCreator, username, ready: true });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { load(s?.user ?? null); });
    return () => sub.subscription.unsubscribe();
  }, []);
  return me;
}

// Runs `fn` whenever deps change. fn must return data or throw; `reload` refetches.
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState({ error: e?.message ?? "Error inesperado", loading: false }),
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// Supabase returns {data, error}; this turns the error into a throw.
export function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
