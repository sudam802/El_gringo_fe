export default function Book() {
  const courts = [
    { id: 1, name: "Court A", time: "9:00 AM - 10:00 AM" },
    { id: 2, name: "Court B", time: "10:00 AM - 11:00 AM" },
    { id: 3, name: "Court C", time: "11:00 AM - 12:00 PM" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">🏟️ Book a Court</h2>
      <div className="grid gap-4">
        {courts.map((c) => (
          <div key={c.id} className="p-4 bg-white shadow rounded-lg">
            <h3 className="text-lg font-semibold">{c.name}</h3>
            <p>🕒 {c.time}</p>
            <button className="mt-2 px-3 py-1 bg-green-600 text-white rounded">
              Book
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
