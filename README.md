
  # Fetch GitHub Repository

  This is a code bundle for Fetch GitHub Repository. The original project is available at https://www.figma.com/design/X1Bp9hJqOTXrmNHVmDXRhC/Fetch-GitHub-Repository.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Backend setup

  Spark can run without Supabase. To prepare the optional backend:

  1. Copy `.env.example` to `.env.local`.
  2. Add your Supabase URL to `VITE_SUPABASE_URL`.
  3. Add your Supabase publishable key to `VITE_SUPABASE_PUBLISHABLE_KEY`.
  4. Set `VITE_USE_SUPABASE=true`.
  5. Run `npm install`.
  6. Run `npm run build`.

  Do not add service role keys or real secrets to frontend source.
  
