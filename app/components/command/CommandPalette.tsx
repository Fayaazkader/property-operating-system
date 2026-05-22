"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import {
  Command
} from "cmdk";

export default function CommandPalette() {

  const router = useRouter();

  const [open, setOpen] =
    useState(false);

  useEffect(() => {

    function down(e: KeyboardEvent) {

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "k"
      ) {

        e.preventDefault();

        setOpen((open) => !open);
      }
    }

    document.addEventListener(
      "keydown",
      down
    );

    return () =>
      document.removeEventListener(
        "keydown",
        down
      );

  }, []);

  const navigate = (
    path: string
  ) => {

    router.push(path);

    setOpen(false);
  };

  if (!open) return null;

  return (

    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[12vh]">

      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">

        <Command className="w-full">

          <div className="border-b border-zinc-200 px-5">

            <Command.Input
              placeholder="Search workspaces, leases, operations..."
              className="
                w-full
                border-0
                py-5
                text-base
                outline-none
              "
            />

          </div>

          <Command.List className="max-h-96 overflow-y-auto p-3">

            <Command.Empty className="p-6 text-sm text-zinc-500">

              No results found.

            </Command.Empty>

            <Command.Group
              heading="Navigation"
              className="mb-4"
            >

              <Command.Item
                onSelect={() =>
                  navigate("/executive")
                }
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Executive Dashboard
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  navigate("/leases")
                }
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Lease Dashboard
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  navigate("/tenants")
                }
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Tenant CRM
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  navigate("/financials")
                }
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Financial Operations
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  navigate("/notifications")
                }
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Notifications Center
              </Command.Item>

            </Command.Group>

            <Command.Group
              heading="Quick Actions"
            >

              <Command.Item
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Generate Portfolio Report
              </Command.Item>

              <Command.Item
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Create Lease
              </Command.Item>

              <Command.Item
                className="
                  cursor-pointer
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  transition
                  hover:bg-zinc-100
                "
              >
                Open Notifications
              </Command.Item>

            </Command.Group>

          </Command.List>

        </Command>

      </div>

    </div>
  );
}