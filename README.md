# Befriend Data

This repository manages the initialization of data used by the [Befriend backend](https://github.com/befriend-app/befriend-backend) via `https://data.befriend.app`.

## Repositories
- [Backend](https://github.com/befriend-app/befriend-backend)
- [Frontend](https://github.com/befriend-app/befriend-app)
- [Web](https://github.com/befriend-app/befriend-web)

## Note

This repository is **not intended for third-party deployment**. The data services rely on unique tokens and identifiers that are synchronized across the entire Befriend network. Running this in production would create duplicate data and prevent proper communication between networks.



## Overview

Befriend Data serves as the central source of data for the app, including:

- Activity types
- Cities
- Schools
- Movies
- Books
- and more

## Integration

The [Befriend backend](https://github.com/befriend-app/befriend-backend) repository automatically requests data from `data.befriend.app` on setup.

## Data Sources

The service aggregates and processes data from multiple sources:

- OpenStreetMap
- Wikidata
- Foursquare
- GeoNames
- User-submitted data (verified and processed)

## Development

While this repository isn't meant for production deployment by third parties, you can set up a development environment for testing and contribution:

1. Clone the repository
```
git clone https://github.com/befriend-app/befriend-data
```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run in development mode:
   ```bash
   npm run server
   ```

## Contributing

We welcome contributions:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with detailed description

## License

LGPL 3.0 or later.
## Contact

For questions about joining the Befriend network or contributing to development:

- Email: dev@befriend.app
