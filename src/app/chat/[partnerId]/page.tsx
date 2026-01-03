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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let client: StreamChat | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        if (!partnerId) return;
        const qs = new URLSearchParams();
        qs.set("partnerId", partnerId);
        qs.set("partnerName", partnerName);
        const res = await fetch(`/api/stream/token?${qs.toString()}`, {
          cache: "no-store",
        });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to create Stream token");

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
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-lg border bg-white p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!chatClient || !channel) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading chat…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Chat client={chatClient} theme="messaging light">
        <Channel channel={channel}>
          <Window>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-white">
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
  );
}
