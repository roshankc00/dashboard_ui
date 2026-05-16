# Dashboard Backend — URL Batch Checker

## 1. Set up env

```bash
cp .env.example .env
```

Update the values in `.env`.

## 2. Install dependencies

```bash
pnpm i
```

## 3. Start MongoDB & Redis

**With Docker:**

```bash
docker compose up
```

**Or locally:** make sure MongoDB and Redis are running, then update the env variables accordingly.

## 4. Run the backend

```bash
pnpm run dev
```

Check which port the backend is running on — make sure the same port is set in your Next.js frontend's `NEXT_PUBLIC_API_URL`.
