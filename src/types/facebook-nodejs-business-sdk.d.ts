declare module 'facebook-nodejs-business-sdk' {
  class FacebookAdsApi {
    static init(accessToken: string): FacebookAdsApi;
  }

  class UserData {
    setEmail(email: string): UserData;
    setPhone(phone: string): UserData;
    setFirstName(firstName: string): UserData;
    setLastName(lastName: string): UserData;
    setCity(city: string): UserData;
    setState(state: string): UserData;
    setCountry(country: string): UserData;
    setDateOfBirth(dob: string): UserData;
    setGender(gender: string): UserData;
    setClientIpAddress(ip: string): UserData;
    setClientUserAgent(ua: string): UserData;
    setFbc(fbc: string): UserData;
    setFbp(fbp: string): UserData;
  }

  class CustomData {
    setCurrency(currency: string): CustomData;
    setValue(value: number): CustomData;
    setContentName(name: string): CustomData;
    setContentCategory(category: string): CustomData;
    setContents(contents: Content[]): CustomData;
    setOrderId(orderId: string): CustomData;
  }

  class Content {
    setId(id: string): Content;
    setQuantity(quantity: number): Content;
  }

  class ServerEvent {
    setEventName(name: string): ServerEvent;
    setEventTime(time: number): ServerEvent;
    setEventId(id: string): ServerEvent;
    setActionSource(source: string): ServerEvent;
    setEventSourceUrl(url: string): ServerEvent;
    setUserData(userData: UserData): ServerEvent;
    setCustomData(customData: CustomData): ServerEvent;
  }

  class EventRequest {
    constructor(accessToken: string, pixelId: string);
    setEvents(events: ServerEvent[]): EventRequest;
    setTestEventCode(code: string): EventRequest;
    execute(): Promise<{ events_received: number }>;
  }

  class EventResponse {
    events_received: number;
  }

  const bizSdk: {
    FacebookAdsApi: typeof FacebookAdsApi;
    UserData: typeof UserData;
    CustomData: typeof CustomData;
    Content: typeof Content;
    ServerEvent: typeof ServerEvent;
    EventRequest: typeof EventRequest;
    EventResponse: typeof EventResponse;
  };

  export default bizSdk;
  export {
    FacebookAdsApi,
    UserData,
    CustomData,
    Content,
    ServerEvent,
    EventRequest,
    EventResponse,
  };
}
