# datarink

## Installation

Clone the `datarink` repository:

```
git clone https://github.com/kevkan/datarink
cd datarink
```

Install dependencies with npm:

```bash
npm install
```

## Database

datarink uses Postgres for storing data. There are two popular options for installing Postgres: Homebrew, and Postgres.app.

### Homebrew

If you don't already have Homebrew, install it:

```bash
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

Once Homebrew is installed Postgres can be installed with:

```bash
brew update
brew install postgres
```

To boot Postgres and have it run in the background:

```bash
pg_ctl -D /usr/local/var/postgres -l /usr/local/var/postgres/server.log start
```

To stop Postgres :

```bash
pg_ctl -D /usr/local/var/postgres stop -s -m fast
```

If you're using Postgres a bunch it's likely worth setting your computer to have it run when your computer starts up. You can find out how to set that up with [LaunchAgents](https://chartio.com/resources/tutorials/how-to-start-postgresql-server-on-mac-os-x/).

### Postgres.app

An alternative way to install Postgres is through  [Postgres.app](http://postgresapp.com/). Follow the instructions on the download page to install it.

## pgAdmin

Now that Postgres is installed and running you'll need to download the pgAdmin client as a GUI to manage your Postgres databases. [Download pgAdmin](https://www.pgadmin.org/download/).

Once installed you can create a database called `datarink`. You'll also need to specify a username and password for the data that you'll use later when setting up the app's environment variables.

## Populating the database

Once you have a database called `datarink`, you'll need to setup its structure. The queries for the structure can be found in `table-creation-queries.md`.

Once you've run the above queries in pgAdmin's Query Tool you'll need to populate the database with data. Do this using the [node-game-scraper](https://github.com/kevkan/node-game-scraper) repo. `node-game-scraper` scrapes data from a few sources and inserts it into the correct columns and tables in the Postgres database. Make sure your local `node-game-scraper` is pointed to the `datarink` database that was just created before scraping.

## Environment variables

If you're running the app locally (not through Heroku), you'll need to define environment variables for the app to properly connect to the local database. Update the `sample.sample-env` file to use your own Postgres database URL and then re-save it as `.env` in the root of the app.

The local database URL should look like:

```bash
HEROKU_POSTGRESQL_COPPER_URL = "postgres://<username>:<password>@<host>:<port>/<databasename>"
```

If you want an extra level of security you can fill out the `AUTHENTICATION` variables. If not needed just set it to `off`.

_Note: if you're connecting to a local Postgres database you may need to change the `ssl` key in the `pgConfig` object defined in `server.js` to `false`._

## Running the server

Now that you have a database connected to the datarink app you can start it by running:

```bash
heroku local web
```

## Building the front-end

To build datarink's front-end:

```
npm run build
```

Browserify will bundle the `/vue-src/*.vue` templates into `/public/build.js`, which is used by `index.html`. When the application is deployed to Heroku, the postinstall script in `package.json` will automatically run and build the front-end.

For local development with hot-reloading:

```
npm run dev
```
