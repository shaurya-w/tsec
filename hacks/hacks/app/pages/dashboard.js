"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function UserDashboard() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inside CooperApp / Dashboard
useEffect(() => {
  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/groups/users');
      const data = await res.json();
      // Access the .users property from your API response
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };
  fetchUsers();
}, []);
  if (loading) return <p className="p-10">Loading groups...</p>;
  if (groups.length === 0) return <p className="p-10">No groups found.</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-10 text-gray-900">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-4xl font-black text-indigo-600 italic">
          COOPER.
        </h1>

        <p className="font-black text-2xl">Welcome User, u3</p>

        <button
          onClick={() => alert("Create Group (placeholder)")}
          className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
        >
          + Create New Group
        </button>
      </div>

      {/* GROUPS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {groups.map((group) => (
          <div
            key={group.id}
            onClick={() => router.push(`/groups/${group.id}`)}
            className="bg-white p-6 rounded-2xl border shadow-sm cursor-pointer hover:shadow-xl transition"
          >
            <h2 className="text-xl font-bold">{group.name}</h2>
            <p className="text-sm text-gray-400 mt-1">
              Group ID: {group.id}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}