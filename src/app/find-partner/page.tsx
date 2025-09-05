export default function FindPartner() {
  const partners = [
    { id: 1, name: "Alice", skill: "Intermediate", location: "Downtown" },
    { id: 2, name: "Bob", skill: "Beginner", location: "West Side" },
    { id: 3, name: "Charlie", skill: "Advanced", location: "North Court" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Find a Partner</h2>
      <div className="grid gap-4">
        {partners.map((p) => (
          <div key={p.id} className="p-4 bg-white shadow rounded-lg">
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p>🎯 {p.skill}</p>
            <p>📍 {p.location}</p>
            <button className="mt-2 px-3 py-1 bg-green-600 text-white rounded">
              Chat
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
