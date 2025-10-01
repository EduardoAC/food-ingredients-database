const getUrl = (contextUrl: string): string => {
  const requestUrl = new URL(contextUrl);
  requestUrl.searchParams.append('API_KEY', process.env.API_KEY ?? '');

  return requestUrl.toString();
};

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  console.log("Request");
  const requestUrl = getUrl(url);

  const requestInit: RequestInit = {
    ...options,
  };

  console.log("requestUrl", requestUrl);
  const response = await fetch(requestUrl, requestInit);
  const data = await response.json();

  return { status: response.status, data, headers: response.headers } as T;
};