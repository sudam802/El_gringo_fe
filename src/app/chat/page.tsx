
"use client";

import { useState } from "react";

export default function Chat() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input) return;
    setMessages([...messages, input]);
    setInput("");
  };

  return (
    <div className="max-w-md mx-auto bg-white shadow-md p-4 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">💬 Chat</h2>
      <div className="h-64 overflow-y-auto border p-2 mb-4">
        {messages.length === 0 ? (
          <p className="text-gray-500">No messages yet</p>
        ) : (
          messages.map((m, i) => (
            <p key={i} className="p-2 bg-gray-100 rounded mb-2">
              {m}
            </p>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="border flex-grow p-2 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}
