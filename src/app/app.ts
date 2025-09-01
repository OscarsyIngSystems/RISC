import { Component, AfterViewInit, ElementRef, ViewChild, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit, OnInit, OnDestroy {
  protected readonly title = signal('Francia');

  @ViewChild('bookElement') bookElement!: ElementRef;
  @ViewChild('backgroundMusic') audioElement!: ElementRef<HTMLAudioElement>;
  @ViewChild('volumeSlider') volumeSlider!: ElementRef<HTMLInputElement>;
  @ViewChild('volumeValue') volumeValue!: ElementRef<HTMLSpanElement>;
  @ViewChild('playPauseBtn') playPauseBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('autoplayOverlay') autoplayOverlay!: ElementRef<HTMLDivElement>;
  @ViewChild('autoplayButton') autoplayButton!: ElementRef<HTMLButtonElement>;

  private audioInitialized = false;
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private audioSource: MediaElementAudioSourceNode | null = null;
  private isPlaying = signal(false);
  private volumeLevel = signal(0.5);
  private userInteracted = false;
  private audioEventListeners: { element: any, event: string, callback: any }[] = [];

  ngOnInit(): void {
    // Escuchar eventos de interacción del usuario para desbloquear audio
    this.setupUserInteractionListeners();
  }

  ngAfterViewInit(): void {
    this.initBookFlip();
    this.initAudioControls();
  }

  ngOnDestroy(): void {
    // Limpiar todos los event listeners
    this.audioEventListeners.forEach(listener => {
      listener.element.removeEventListener(listener.event, listener.callback);
    });

    // Cerrar el contexto de audio si existe
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  private setupUserInteractionListeners(): void {
    const enableAudio = () => {
      if (!this.userInteracted) {
        this.userInteracted = true;
        console.log('Usuario interactuó, audio desbloqueado');

        // Si el audio estaba pausado pero debería estar reproduciendo, intentar reproducir
        if (this.isPlaying() && this.audioElement?.nativeElement.paused) {
          this.playAudio();
        }
      }
    };

    // Eventos que pueden desbloquear el audio
    const events = ['click', 'touchstart', 'keydown', 'scroll'];

    events.forEach(event => {
      const callback = enableAudio.bind(this);
      document.addEventListener(event, callback, { once: true, passive: true });
      this.audioEventListeners.push({ element: document, event, callback });
    });
  }

  private initBookFlip(): void {
    const elBook = this.bookElement.nativeElement;
    elBook.style.setProperty('--c', '0');

    const pages = elBook.querySelectorAll('.page');
    pages.forEach((page: HTMLElement, i: number) => {
      page.style.setProperty('--i', i.toString());

      const clickHandler = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const clickedOnBack = !!target.closest('.back');
        const newPage = clickedOnBack ? i : i + 1;
        elBook.style.setProperty('--c', newPage.toString());

        // Registrar interacción del usuario
        if (!this.userInteracted) {
          this.userInteracted = true;
        }
      };

      page.addEventListener('click', clickHandler);
      this.audioEventListeners.push({ element: page, event: 'click', callback: clickHandler });
    });
  }

  private initAudioControls(): void {
    const audio = this.audioElement.nativeElement;
    const volumeSlider = this.volumeSlider.nativeElement;
    const volumeValue = this.volumeValue.nativeElement;
    const playPauseBtn = this.playPauseBtn.nativeElement;
    const autoplayOverlay = this.autoplayOverlay.nativeElement;
    const autoplayButton = this.autoplayButton.nativeElement;

    // Configuración inicial
    audio.volume = 0.5;
    volumeSlider.value = '5';
    volumeValue.textContent = '5';

    // Mostrar controles de audio
    const audioControls = document.querySelector('.audio-controls') as HTMLElement;
    if (audioControls) {
      audioControls.style.display = 'flex';
    }

    // Configurar analizador de audio para visualizaciones (opcional)
    this.setupAudioAnalyser();

    // Control de volumen
    const volumeHandler = () => {
      const volumeLevel = Number(volumeSlider.value) / 10;
      audio.volume = volumeLevel;
      this.volumeLevel.set(volumeLevel);
      volumeValue.textContent = volumeSlider.value;
    };

    volumeSlider.addEventListener('input', volumeHandler);
    this.audioEventListeners.push({ element: volumeSlider, event: 'input', callback: volumeHandler });

    // Control de reproducción/pausa
    const playPauseHandler = () => {
      if (audio.paused) {
        this.playAudio();
      } else {
        this.pauseAudio();
      }
    };

    playPauseBtn.addEventListener('click', playPauseHandler);
    this.audioEventListeners.push({ element: playPauseBtn, event: 'click', callback: playPauseHandler });

    // Botón de autoplay
    const autoplayHandler = () => {
      this.userInteracted = true;
      this.playAudio();
      autoplayOverlay.style.display = 'none';
    };

    autoplayButton.addEventListener('click', autoplayHandler);
    this.audioEventListeners.push({ element: autoplayButton, event: 'click', callback: autoplayHandler });

    // Eventos del elemento de audio
    const loadedHandler = () => {
      console.log('Audio cargado');
      this.audioInitialized = true;
    };

    const playHandler = () => {
      this.isPlaying.set(true);
      playPauseBtn.textContent = 'Pausar';
      autoplayOverlay.style.display = 'none';
    };

    const pauseHandler = () => {
      this.isPlaying.set(false);
      playPauseBtn.textContent = 'Reproducir';
    };

    const errorHandler = (error: any) => {
      console.error('Error en el audio:', error);
      autoplayOverlay.style.display = 'flex';
    };

    audio.addEventListener('loadeddata', loadedHandler);
    audio.addEventListener('play', playHandler);
    audio.addEventListener('pause', pauseHandler);
    audio.addEventListener('error', errorHandler);

    this.audioEventListeners.push({ element: audio, event: 'loadeddata', callback: loadedHandler });
    this.audioEventListeners.push({ element: audio, event: 'play', callback: playHandler });
    this.audioEventListeners.push({ element: audio, event: 'pause', callback: pauseHandler });
    this.audioEventListeners.push({ element: audio, event: 'error', callback: errorHandler });

    // Intentar cargar el audio
    audio.load();
    this.audioInitialized = true;

    // Mostrar overlay de autoplay inicialmente
    autoplayOverlay.style.display = 'flex';
  }

  private setupAudioAnalyser(): void {
    // Configurar el analizador de audio para visualizaciones (opcional)
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        this.audioContext = new AudioContext();
        const audio = this.audioElement.nativeElement;

        this.audioSource = this.audioContext.createMediaElementSource(audio);
        this.audioAnalyser = this.audioContext.createAnalyser();

        this.audioSource.connect(this.audioAnalyser);
        this.audioAnalyser.connect(this.audioContext.destination);

        // Puedes usar this.audioAnalyser para visualizaciones de audio
      }
    } catch (e) {
      console.warn('El API de Audio Web no está soportado en este navegador', e);
    }
  }

  private async playAudio(): Promise<void> {
    const audio = this.audioElement.nativeElement;
    const autoplayOverlay = this.autoplayOverlay.nativeElement;

    if (!this.userInteracted) {
      console.warn('Audio bloqueado: se requiere interacción del usuario primero');
      autoplayOverlay.style.display = 'flex';
      return;
    }

    try {
      // Si el contexto de audio está suspendido (por políticas de autoplay), reanudarlo
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      await audio.play();
      this.isPlaying.set(true);
    } catch (error) {
      console.warn('Error al reproducir audio:', error);
      autoplayOverlay.style.display = 'flex';
    }
  }

  private pauseAudio(): void {
    const audio = this.audioElement.nativeElement;
    audio.pause();
    this.isPlaying.set(false);
  }

  // Método público para permitir que otros componentes inicien la música
  public startMusic(): void {
    if (this.audioInitialized) {
      this.playAudio();
    }
  }

  // Método para cambiar el volumen programáticamente
  public setVolume(level: number): void {
    if (this.audioInitialized) {
      const audio = this.audioElement.nativeElement;
      const volumeSlider = this.volumeSlider.nativeElement;
      const volumeValue = this.volumeValue.nativeElement;

      const clampedLevel = Math.max(0, Math.min(1, level));
      audio.volume = clampedLevel;
      this.volumeLevel.set(clampedLevel);

      const sliderValue = Math.round(clampedLevel * 10);
      volumeSlider.value = sliderValue.toString();
      volumeValue.textContent = sliderValue.toString();
    }
  }

  // Método para alternar entre play/pause
  public togglePlayback(): void {
    if (this.isPlaying()) {
      this.pauseAudio();
    } else {
      this.playAudio();
    }
  }
}
