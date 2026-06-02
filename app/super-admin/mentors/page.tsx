"use client";

import { AddMentorModal } from "@/components/modals/AddManagerModal";
import { UsersListPage } from "@/components/pages/UsersListPage";

export default function MentorsPage() {
  return (
    <UsersListPage
      apiPath="/api/mentors"
      title="Mentors"
      addTitle="Add Mentor"
      ModalComponent={AddMentorModal}
    />
  );
}
