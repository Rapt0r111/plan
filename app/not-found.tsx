import CharactersAnimation from "@/features/not-found/CharactersAnimation";
import CircleAnimation from "@/features/not-found/CircleAnimation";
import MessageDisplay from "@/features/not-found/MessageDisplay";


export default function NotFoundPage() {
  return (
    <div className="w-full h-screen bg-black overflow-x-hidden flex justify-center items-center relative">
      <MessageDisplay />
      <CharactersAnimation />
      <CircleAnimation />
    </div>
  );
}