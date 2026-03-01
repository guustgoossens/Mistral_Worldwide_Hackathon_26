import { Routes, Route } from "react-router-dom";
import { LandingPage } from "@/components/LandingPage";
import { RepoView } from "@/components/RepoView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/:repoId" element={<RepoView />} />
    </Routes>
  );
}
