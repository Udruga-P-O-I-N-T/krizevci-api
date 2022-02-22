import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { formatISO, addMonths, isAfter, startOfDay } from 'date-fns';
import { sortBy } from 'lodash';
import * as cheerio from 'cheerio';
import * as NodeCache from 'node-cache';

import { Event } from './event.entity';

const cache = new NodeCache();

@Injectable()
export class EventsService {
  constructor(private httpService: HttpService) {}

  onModuleInit() {
    this.findAllEvents();
    setInterval(() => this.findAllEvents(), 30 * 60 * 1000);
  }

  async findFuturehubEvents(): Promise<Event[]> {
    const url = 'https://futurehub.krizevci.eu/api/events/';
    const source = this.httpService.get(url);
    const response = await firstValueFrom(source);

    return response.data.data
      .filter((item) =>
        isAfter(new Date(item.attributes.datetime), startOfDay(new Date())),
      )
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
    const endDate = formatISO(addMonths(new Date(), 2), {
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
      url: 'https://krizevci.hr/godisnji-kalendar-dogadanja/',
    }));
  }

  async findKinoEvents(): Promise<Event[]> {
    const source = this.httpService.get('https://kino.krizevci.hr/');
    const response = await firstValueFrom(source);
    const $ = cheerio.load(response.data);
    const movieLinks = new Set<string>();
    $('a[href^=https://kino.krizevci.hr/film]').each(function () {
      movieLinks.add($(this).attr('href'));
    });
    const events = await Promise.all(
      [...movieLinks].map(async (link) => {
        const source = this.httpService.get(link);
        const response = await firstValueFrom(source);
        const $ = cheerio.load(response.data);
        const event: Event = {
          id: link,
          url: link,
          name: $('meta[property="og:title"]').attr('content') ?? null,
          image: $('meta[property="og:image"]').attr('content') ?? null,
          description:
            $('meta[property="og:description"]').attr('content') ?? null,
          endDate: null,
          organizer: { name: 'Kino Križevci' },
        };
        const dates = [];
        $('.st-item').each(function () {
          const [day, month, year] = $(this)
            .find('.st-title')
            .text()
            .split('/');
          const hour = $(this).find('li').text().replace('h', '');
          const isoDate = `${year}-${month}-${day}T${hour}:00:00`;
          dates.push(isoDate);
        });
        return (
          dates
            // Omit past events
            .filter((date) => isAfter(new Date(date), startOfDay(new Date())))
            .map((date) => ({ ...event, startDate: date }))
        );
      }),
    );
    return events.flat();
  }

  async findAllEvents(): Promise<Event[]> {
    const cacheKey = 'events';
    const cacheEvents: Event[] = cache.get(cacheKey);
    if (cacheEvents) {
      return cacheEvents;
    }
    const events = sortBy(
      [
        ...(await this.findFuturehubEvents()),
        ...(await this.findTuristickaZajednicaEvents()),
        ...(await this.findKinoEvents()),
      ],
      'startDate',
    );
    cache.set(cacheKey, events, 30 * 60);
    return events;
  }
}
