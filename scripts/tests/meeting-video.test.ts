import {expect,test} from 'bun:test';
import {meetingVideoUrl,meetingVideoEmbed} from '../../apps/web/src/lib/meeting-video';

test('YouTube watch, short, live, shorts and embed URLs use a canonical player',()=>{
  for(const url of [
    'https://www.youtube.com/watch?v=wjYeLMR-3tE&list=unsafe&autoplay=1',
    'https://youtu.be/wjYeLMR-3tE', 'https://www.youtube.com/live/wjYeLMR-3tE',
    'https://m.youtube.com/shorts/wjYeLMR-3tE', 'https://www.youtube-nocookie.com/embed/wjYeLMR-3tE',
  ]) expect(meetingVideoEmbed(url)).toEqual({src:'https://www.youtube-nocookie.com/embed/wjYeLMR-3tE',provider:'YouTube'});
  expect(meetingVideoEmbed('https://youtu.be/wjYeLMR-3tE?t=1h2m3s')?.src).toEndWith('?start=3723');
  expect(meetingVideoEmbed('https://www.youtube.com/watch?v=wjYeLMR-3tE&start=30')?.src).toEndWith('?start=30');
});
test('Vimeo public and unlisted URLs preserve the privacy hash',()=>{
  expect(meetingVideoEmbed('https://vimeo.com/76979871')).toEqual({src:'https://player.vimeo.com/video/76979871',provider:'Vimeo'});
  expect(meetingVideoEmbed('https://vimeo.com/76979871/abc123')?.src).toBe('https://player.vimeo.com/video/76979871?h=abc123');
  expect(meetingVideoEmbed('https://player.vimeo.com/video/76979871?h=abc123&autoplay=1')?.src).toBe('https://player.vimeo.com/video/76979871?h=abc123');
});
test('rejects unsafe URLs and never turns arbitrary URLs into embeds',()=>{
  for(const value of [null,'','javascript:alert(1)','http://youtu.be/wjYeLMR-3tE',('https://' + 'user:pass@' + 'youtube.com/watch?v=wjYeLMR-3tE'),'https://youtube.com:444/watch?v=wjYeLMR-3tE','https://youtu.be/wjYeLMR-3tE\n']){
    expect(meetingVideoUrl(value)).toBeNull();expect(meetingVideoEmbed(value)).toBeNull();
  }
  for(const value of ['https://youtube.com.evil.test/watch?v=wjYeLMR-3tE','https://example.test/video','https://www.youtube.com/watch?v=bad','https://vimeo.com/not-a-video'])expect(meetingVideoEmbed(value)).toBeNull();
  expect(meetingVideoUrl('https://example.test/video.mp4')).toBe('https://example.test/video.mp4');
});
