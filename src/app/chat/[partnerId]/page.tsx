"use client";

import { useEffect, useMemo, useState } from "react";
import { StreamChat } from "stream-chat";
import {
  Chat,
  Channel,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { authHeader } from "@/lib/authToken";

type StreamTokenResponse = {
  apiKey: string;
  token: string;
  user: { id: string; name: string; image?: string };
  channelId: string | null;
};

export default function ChatPage() {
  const router = useRouter();
  const { partnerId } = useParams<{ partnerId: string }>();
  const searchParams = useSearchParams();
  const partnerName = (searchParams.get("name") ?? "Partner").toString();
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [serverChannelId, setServerChannelId] = useState<string | null>(null);
  const [canMessage, setCanMessage] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let client: StreamChat | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        if (!partnerId) return;
        setError(null);
        setCanMessage(null);
        setChatClient(null);
        setServerChannelId(null);

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (!backendUrl) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
        const base = String(backendUrl).trim().replace(/\/+$/, "");

        const statusRes = await fetch(
          `${base}/api/friends/status?userId=${encodeURIComponent(partnerId)}`,
          { credentials: "include", headers: authHeader(), cache: "no-store" }
        );
        if (statusRes.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (!statusRes.ok) throw new Error("Failed to check friendship status");
        const statusPayload = (await statusRes.json()) as { canMessage?: boolean };
        if (!statusPayload?.canMessage) {
          setCanMessage(false);
          return;
        }
        setCanMessage(true);

        const qs = new URLSearchParams();
        qs.set("partnerId", partnerId);
        qs.set("partnerName", partnerName);
        const res = await fetch(`/api/stream/token?${qs.toString()}`, {
          cache: "no-store",
          headers: authHeader(),
        });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (!res.ok) {
          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const body = (await res.json()) as { message?: string };
            throw new Error(body?.message || "Failed to start chat");
          }
          throw new Error((await res.text()) || "Failed to start chat");
        }

        const { apiKey, token, user, channelId } =
          (await res.json()) as StreamTokenResponse;
        if (!apiKey) throw new Error("Missing Stream API key");
        if (!token) throw new Error("Missing Stream token");
        if (!user?.id) throw new Error("Missing user id");

        client = StreamChat.getInstance(apiKey);
        await client.connectUser(
          { id: user.id, name: user.name, ...(user.image ? { image: user.image } : {}) },
          token
        );

        if (cancelled) return;
        setChatClient(client);
        setServerChannelId(channelId);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to start chat");
      }
    };

    init();

    return () => {
      cancelled = true;
      if (client) {
        client.disconnectUser().catch(() => {});
      }
    };
  }, [router, partnerId, partnerName]);

  const channel = useMemo(() => {
    if (!chatClient) return null;
    if (!partnerId) return null;
    if (!chatClient.userID) return null;
    const members = [chatClient.userID, partnerId];
    const channelId = serverChannelId ?? members.slice().sort().join("__");
    return chatClient.channel("messaging", channelId, { members });
  }, [chatClient, partnerId, serverChannelId]);

  useEffect(() => {
    if (!channel) return;
    channel.watch().catch(() => {});
  }, [channel]);

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-lg w-full app-card p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (canMessage === false) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-lg w-full app-card p-4 text-gray-800">
          You can only message accepted friends.
        </div>
      </div>
    );
  }

  if (!chatClient || !channel) {
    return (
      <div className="min-h-full flex items-center justify-center text-gray-500">
        Loading chat…
      </div>
    );
  }

  return (
    <div className="min-h-full app-container py-6">
      <div className="app-card overflow-hidden min-h-[70vh]">
        <Chat client={chatClient} theme="messaging light">
          <Channel channel={channel}>
            <Window>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70 bg-white/70 backdrop-blur">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-sm text-gray-700 hover:underline"
              >
                Back
              </button>
              <div className="text-sm font-semibold text-gray-900 truncate">
                {partnerName}
              </div>
              <div className="w-10" />
            </div>
            <MessageList />
            <MessageInput focus />
          </Window>
          <Thread />
        </Channel>
        </Chat>
      </div>
    </div>
  );
}
