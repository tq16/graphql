const GRAPHQL_URL = "https://learn.reboot01.com/api/graphql-engine/v1/graphql";
const JWT_STORAGE_KEY = "jwt";

const graphqlRequest = async (query, variables = {}) => {
  const token = localStorage.getItem(JWT_STORAGE_KEY);
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`HTTP ${response.status}: ${text}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  if (data.errors && data.errors.length) {
    const error = new Error(data.errors[0].message || "GraphQL error");
    error.graphqlErrors = data.errors;
    throw error;
  }

  return data.data;
};

window.graphqlRequest = graphqlRequest;
