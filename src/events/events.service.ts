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
        // TODO: Convert datetime to GMT, because this is incorrect around midnight
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

  async findGrobljeEvents(): Promise<Event[]> {
    const url = 'https://komunalno.hr/groblja/gradsko-groblje-krizevci/';
    const source = this.httpService.get(url);
    const response = await firstValueFrom(source);
    const events: Event[] = [];
    const $ = cheerio.load(response.data);
    $('.termini_ukopa .card-body').each(function (index) {
      const name = $(this).find('h3').text();
      const description = $(this).find('p').text();
      const [day, month, year] = description
        .match(/\d\d.\d\d.\d\d\d\d/)[0]
        .split('.');
      const [hour, minutes] = description.match(/\d\d,\d\d/)[0].split(',');
      const startDate = `${year}-${month}-${day}T${hour}:${minutes}:00`;
      // Omit past events
      if (!isAfter(new Date(startDate), startOfDay(new Date()))) {
        return;
      }
      events.push({
        id: `groblje-${index}`,
        url,
        name,
        description,
        startDate,
        organizer: { name: 'Gradsko groblje Križevci' },
      });
    });
    return events;
  }

  async findAllEvents(): Promise<Event[]> {
    const cacheKey = 'events';
    const cacheEvents: Event[] = cache.get(cacheKey);
    if (cacheEvents) {
      return cacheEvents;
    }
    let events = (
      await Promise.all([
        this.findFuturehubEvents(),
        this.findTuristickaZajednicaEvents(),
        this.findKinoEvents(),
        this.findGrobljeEvents(),
      ])
    ).flat();
    events = sortBy(events, ['startDate', 'endDate']);
    cache.set(cacheKey, events, 30 * 60);
    return events;
  }
}
