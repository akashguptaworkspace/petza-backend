# petza-backend

## Docker

Build the development image:

```sh
docker build --target development -t petza-backend:dev .
```

Run it with your local env file:

```sh
docker run --env-file .env.dev -p 4000:4000 -v petza_backend_uploads:/app/uploads petza-backend:dev
```

Build the production image:

```sh
docker build --target production -t petza-backend:prod .
```
