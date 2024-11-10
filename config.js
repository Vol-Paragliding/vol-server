const LOCAL_API_ENDPOINT = "http://localhost:8080";
const PROD_API_ENDPOINT = "https://vol-server-a7417ca800ec.herokuapp.com";
const LOCAL_FRONTEND_URL = "http://localhost:3000";
const PROD_FRONTEND_URL = "https://vol.flights";

const FRONTEND_URL =
  process.env.NODE_ENV === "development"
    ? LOCAL_FRONTEND_URL
    : PROD_FRONTEND_URL;

const API_ENDPOINT =
  process.env.NODE_ENV === "development"
    ? LOCAL_API_ENDPOINT
    : PROD_API_ENDPOINT;

const SESSION_SECRET = process.env.SESSION_SECRET;

module.exports = {
  API_ENDPOINT,
  SESSION_SECRET,
  FRONTEND_URL,
};
