"use client";

import { useState, useEffect } from "react";

export default function SelectUsers({ selectedUsers, setSelectedUsers }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ State for new event inputs
  const [newEventName, setNewEventName] = useState("");
  const [categories, setCategories] = useState([
    { name: "", spendingLimit: "" },
  ]); // Dynamic sub-events

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/groups/users");
        if (!res.ok) throw new Error("Failed to fetch users");
        const data = await res.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch (err) {
        console.error("Error fetching users:", err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // ✅ Corrected event creation
  const handleEventCreation = async (e) => {
    e.preventDefault(); // Prevent page reload

    // Validate inputs
    if (!newEventName || selectedUsers.length === 0) {
      alert("Please fill in event name and select participants.");
      return;
    }

    if (categories.some((cat) => !cat.name || !cat.spendingLimit)) {
      alert("Please fill in all category names and spending limits.");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/api/create-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newEventName,
          groupId: "g1", // Replace with dynamic groupId if needed
          selectedUserIds: selectedUsers,
          categories: categories.map((cat) => ({
            name: cat.name,
            spendingLimit: parseFloat(cat.spendingLimit),
          })),
        }),
      });

      if (!res.ok) throw new Error("Failed to create event");

      const data = await res.json();
      console.log("Event created successfully:", data);
      alert("Event created successfully!");

      // ✅ Reset form
      setNewEventName("");
      setSelectedUsers([]);
      setCategories([{ name: "", spendingLimit: "" }]);
    } catch (err) {
      console.error("Error creating event:", err);
      alert("Failed to create event. Check console for details.");
    }
  };

  const handleCategoryChange = (index, field, value) => {
    setCategories((prev) =>
      prev.map((cat, i) => (i === index ? { ...cat, [field]: value } : cat))
    );
  };

  const addCategory = () => {
    setCategories((prev) => [...prev, { name: "", spendingLimit: "" }]);
  };

  const removeCategory = (index) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) return <p>Loading users...</p>;
  if (users.length === 0) return <p>No users found.</p>;

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-200 mb-12">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Launch New Event</h2>
      <form onSubmit={handleEventCreation} className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <input
            type="text"
            placeholder="Event Name"
            className="w-full bg-gray-50 p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
          />

          {/* Dynamic Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-700">Add Sub-Events </h3>
            {categories.map((cat, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Category Name"
                  className="w-1/2 bg-gray-50 p-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={cat.name}
                  onChange={(e) => handleCategoryChange(idx, "name", e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Spending Limit"
                  className="w-1/2 bg-gray-50 p-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={cat.spendingLimit}
                  onChange={(e) =>
                    handleCategoryChange(idx, "spendingLimit", e.target.value)
                  }
                />
                {categories.length > 1 && (
                  <button
                    type="button"
                    className="bg-red-500 text-white px-3 rounded-xl font-bold"
                    onClick={() => removeCategory(idx)}
                  >
                    X
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold"
              onClick={addCategory}
            >
              + Add Category
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <label className="block text-gray-800 font-bold mb-2">Select Participants:</label>
          <div className="p-4 bg-white rounded-xl shadow-md max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Group Members</h2>
            <ul className="divide-y divide-gray-200">
              {users.map((u, idx) => (
                <li
                  key={`${u.id}-${idx}`}
                  className="py-2 flex items-center justify-between"
                >
                  <span className="text-gray-700 font-medium">{u.name}</span>
                  {selectedUsers && setSelectedUsers && (
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() =>
                        setSelectedUsers((prev) =>
                          prev.includes(u.id)
                            ? prev.filter((id) => id !== u.id)
                            : [...prev, u.id]
                        )
                      }
                    />
                  )}
                </li>
              ))}
            </ul>

            <button
              type="submit"
              className="w-full bg-black text-white font-black py-5 rounded-2xl mt-8 hover:bg-indigo-700 transition-all active:scale-95"
            >
              INITIALIZE BASKET
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
