// Google Identity Services token client (client-side OAuth for Calendar).
// Load https://accounts.google.com/gsi/client in index.html before using.
declare const google: any;

export function getCalendarToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: (resp: any) => resp?.access_token ? resolve(resp.access_token) : reject(new Error("no token")),
    });
    tokenClient.requestAccessToken();
  });
}
