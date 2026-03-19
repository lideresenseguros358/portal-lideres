declare module '@shoopiapp/paguelofacil' {
  export interface CardInformation {
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvv: string;
    firstName: string;
    lastName: string;
    cardType: string;
  }

  export interface PaymentInformation {
    amount: number;
    taxAmount: number;
    email: string;
    phone: string;
    concept: string;
    description: string;
    lang?: string;
    customFieldValues?: Array<[string, string, string]>;
  }

  export interface ReverseInformation {
    codOper: string;
    amount: number;
    description: string;
    lang?: string;
    customFieldValues?: Array<[string, string, string]>;
  }

  export interface CaptureInformation {
    amount: number;
    taxAmount: number;
    email: string;
    phone: string;
    concept: string;
    description: string;
    lang?: string;
    customFieldValues?: Array<[string, string, string]>;
    codOper: string;
  }

  export default class PagueloFacil {
    constructor(cclw: string, token: string, environment: string);
    AuthCapture(paymentInfo: PaymentInformation, cardInfo: CardInformation): Promise<any>;
    Authorize(paymentInfo: PaymentInformation, cardInfo: CardInformation): Promise<any>;
    Capture(captureInfo: CaptureInformation): Promise<any>;
    Reverse(reverseInfo: ReverseInformation): Promise<any>;
    Void(reverseInfo: ReverseInformation): Promise<any>;
    Recurrent(recurrentInfo: CaptureInformation): Promise<any>;
  }
}
