import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { formatISO, addMonths } from 'date-fns';

import { Event } from './event.entity';

@Injectable()
export class EventsService {
  constructor(private httpService: HttpService) {}

  async findFuturehubEvents(): Promise<Event[]> {
    const url = 'https://futurehub.krizevci.eu/api/events/';
    const source = this.httpService.get(url);
    const response = await firstValueFrom(source);

    return response.data.data
      .filter((item) => item.attributes.status === 'Predstoji/traje')
      .map((item) => ({
        id: `fh-${item.id}`,
        name: item.attributes.title,
        startDate: item.attributes.datetime,
        endDate: null,
        location: { name: item.attributes.place },
        organizer: { name: 'Future Hub Križevci' },
        url: `https://futurehub.krizevci.eu/program/${item.attributes.course_code}`,
      }));
  }

  async findTuristickaZajednicaEvents(): Promise<Event[]> {
    const startDate = formatISO(new Date(), { representation: 'date' });
    const endDate = formatISO(addMonths(new Date(), 1), {
      representation: 'date',
    });
    const url = `https://teamup.com/ksitdko5fjg57vfxnv/events?startDate=${startDate}&endDate=${endDate}&tz=Europe%2FZagreb`;
    const source = this.httpService.get(url);
    const response = await firstValueFrom(source);

    return response.data.events.map((event) => ({
      id: `tz-${event.id}`,
      name: event.title,
      startDate: event.start_dt,
      endDate: event.end_dt,
      location: { name: event.location },
      organizer: { name: event.who },
      url: null,
    }));
  }

  async findAllEvents(): Promise<Event[]> {
    const fh = await this.findFuturehubEvents();
    const tz = await this.findTuristickaZajednicaEvents();

    return [...fh, ...tz];
  }
}
