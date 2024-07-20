const LOCAL_API_ENDPOINT = "http://localhost:8080";
const PROD_API_ENDPOINT = "https://vol-server-a7417ca800ec.herokuapp.com";

const API_ENDPOINT =
  process.env.NODE_ENV === "development"
    ? LOCAL_API_ENDPOINT
    : PROD_API_ENDPOINT;

const SESSION_SECRET = process.env.SESSION_SECRET;

module.exports = {
  API_ENDPOINT,
  SESSION_SECRET,
};
