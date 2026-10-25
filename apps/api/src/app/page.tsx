export default function Home() {
  return (
    <main>
      <h1>StudySpark AI API</h1>
      <p>This server powers AI flashcard and quiz generation for the StudySpark AI app.</p>
      <ul>
        <li>
          <code>GET /api/v1/health</code>: status, configuration and today&apos;s usage
        </li>
        <li>
          <code>POST /api/v1/ai/flashcards</code>
        </li>
        <li>
          <code>POST /api/v1/ai/quiz</code>
        </li>
      </ul>
    </main>
  );
}
