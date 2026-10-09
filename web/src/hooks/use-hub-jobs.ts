"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveData } from "@/lib/api";
import { deleteHubJob, saveHubJob, setHubJobStatus, subscribeHubJobs } from "@/lib/firebase/hub-jobs";
import { demoHubJobs } from "@/lib/hub/demo-jobs";
import type { HubJob } from "@/lib/hub/types";
import { useAuthStore } from "@/store/auth";

const MOCK_KEY = "atlas_hub_jobs_v1";
const MOCK_EVENT = "atlas:hub-jobs";

function readMock(createdBy: string): HubJob[] {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    if (raw) return JSON.parse(raw) as HubJob[];
  } catch {
    /* fall through to the samples */
  }
  const seeded = demoHubJobs(createdBy);
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(seeded));
  } catch {
    /* private mode */
  }
  return seeded;
}

function writeMock(jobs: HubJob[]) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(jobs));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(MOCK_EVENT));
}

/** Quote Hub jobs (shared by desk in the live app; browser-only samples in mock/demo mode). */
export function useHubJobs() {
  const user = useAuthStore((s) => s.user);
  const username = (user?.username || "demo").toLowerCase();
  const [jobs, setJobs] = useState<HubJob[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (useLiveData) {
      return subscribeHubJobs(
        (list) => {
          setJobs(list);
          setReady(true);
        },
        (e) => {
          console.warn("Quote Hub jobs:", e.message);
          setReady(true);
        },
      );
    }
    const load = () => {
      setJobs(readMock(username));
      setReady(true);
    };
    load();
    window.addEventListener(MOCK_EVENT, load);
    return () => window.removeEventListener(MOCK_EVENT, load);
  }, [user, username]);

  const add = useCallback(async (job: HubJob) => {
    if (useLiveData) await saveHubJob(job);
    else writeMock([job, ...readMock(username)]);
  }, [username]);

  const setStatus = useCallback(async (id: string, status: HubJob["status"]) => {
    if (useLiveData) await setHubJobStatus(id, status);
    else writeMock(readMock(username).map((j) => (j.id === id ? { ...j, status } : j)));
  }, [username]);

  const remove = useCallback(async (id: string) => {
    if (useLiveData) await deleteHubJob(id);
    else writeMock(readMock(username).filter((j) => j.id !== id));
  }, [username]);

  return { jobs, ready, add, setStatus, remove };
}
