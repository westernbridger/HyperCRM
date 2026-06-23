"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getContacts,
  updateContact,
  type Contact,
  type UpdateContactInput,
} from "@/app/actions/contacts";

export const contactsKey = ["contacts"] as const;

// Fetch all contacts for the current workspace. Throws on error so the
// React Query error/loading states (and route error.tsx) handle failures.
export function useContacts() {
  return useQuery({
    queryKey: contactsKey,
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await getContacts();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

type UpdateVars = {
  id: string;
  input: UpdateContactInput;
  previousStatus?: Contact["status"];
};

// Update a contact with optimistic cache updates + rollback on failure.
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input, previousStatus }: UpdateVars) => {
      const { data, error } = await updateContact(id, input, previousStatus);
      if (error) throw new Error(error);
      return data;
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: contactsKey });
      const snapshot = queryClient.getQueryData<Contact[]>(contactsKey);
      queryClient.setQueryData<Contact[]>(contactsKey, (prev) =>
        (prev ?? []).map((c) => (c.id === id ? { ...c, ...input } : c))
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the pre-mutation snapshot.
      if (context?.snapshot) {
        queryClient.setQueryData(contactsKey, context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactsKey });
    },
  });
}
