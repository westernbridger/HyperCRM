"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TestPage() {
  const [user, setUser] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    setLoading(false);
  }

  async function signUp() {
    const { data, error } = await supabase.auth.signUp({
      email: `hypercrm.test.${Date.now()}@gmail.com`,
      password: "testpassword123",
      options: {
        data: {
          first_name: "Test",
          last_name: "User",
          company_name: "Test Company",
        },
      },
    });

    if (error) {
      alert("Signup error: " + error.message);
    } else {
      alert("Signup successful! Check your email or confirm in Supabase.");
      setUser(data.user);
    }
  }

  async function signIn() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: prompt("Enter email:") || "",
      password: prompt("Enter password:") || "",
    });

    if (error) {
      alert("Signin error: " + error.message);
    } else {
      setUser(data.user);
    }
  }

  async function fetchContacts() {
    const { data, error } = await supabase.from("contacts").select("*");
    if (error) {
      alert("Error fetching contacts: " + error.message);
    } else {
      setContacts(data || []);
    }
  }

  async function createTestContact() {
    const { data, error } = await supabase.from("contacts").insert({
      first_name: "John",
      last_name: "Doe",
      email: `john${Date.now()}@example.com`,
      phone: "+1 555-1234",
      company: "Acme Corp",
      status: "Lead",
      custom_fields: { jobTitle: "CEO", industry: "Technology" },
    }).select();

    if (error) {
      alert("Error creating contact: " + error.message);
    } else {
      alert("Contact created!");
      fetchContacts();
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Supabase Integration Test</h1>

      {/* Auth Section */}
      <div className="p-4 border rounded-lg">
        <h2 className="font-semibold mb-2">Authentication Status</h2>
        {user ? (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">✓ Authenticated</p>
              <p className="text-sm text-muted-foreground">Email: {user.email}</p>
              <p className="text-xs text-muted-foreground">User ID: {user.id}</p>
            </div>
            <div className="space-x-2">
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  setContacts([]);
                }} 
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sign Out
              </button>
              <a href="/" className="inline-block px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
                Go to Dashboard
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700">✗ Not authenticated</p>
              <p className="text-sm text-muted-foreground">You need to sign in to access the app.</p>
            </div>
            <div className="space-x-2">
              <a href="/login" className="inline-block px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
                Go to Login Page
              </a>
              <a href="/signup" className="inline-block px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600">
                Go to Signup Page
              </a>
              <button onClick={signUp} className="px-4 py-2 bg-blue-500 text-white rounded">
                Quick Test Sign Up
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contacts Section */}
      {user && (
        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="font-semibold">Contacts Test</h2>
          
          <div className="space-x-2">
            <button onClick={fetchContacts} className="px-4 py-2 bg-green-500 text-white rounded">
              Fetch Contacts
            </button>
            <button onClick={createTestContact} className="px-4 py-2 bg-purple-500 text-white rounded">
              Create Test Contact
            </button>
          </div>

          {contacts.length > 0 && (
            <div>
              <h3 className="font-medium mt-4">Found {contacts.length} contacts:</h3>
              <ul className="mt-2 space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="p-2 bg-muted rounded text-sm">
                    <strong>{c.first_name} {c.last_name}</strong> ({c.email}) - {c.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="p-4 border rounded-lg bg-yellow-50">
        <h2 className="font-semibold">Test Steps:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click "Sign Up" to create a test user</li>
          <li>Check Supabase Dashboard → Auth → Users to confirm user created</li>
          <li>Check Supabase Dashboard → Table Editor → workspaces to see auto-created workspace</li>
          <li>Click "Create Test Contact" to add a contact</li>
          <li>Click "Fetch Contacts" to verify RLS is working (only sees your workspace contacts)</li>
        </ol>
      </div>
    </div>
  );
}
